using System.Text;
using System.Text.Json;
using MQTTnet; using MQTTnet.Client;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(opts => opts.AddDefaultPolicy(p => p
  .AllowAnyOrigin()
  .AllowAnyHeader()
  .AllowAnyMethod()
));
var app = builder.Build();

// Redis bağlantısı
var redisConn = Environment.GetEnvironmentVariable("REDIS_CONN") ?? "redis:6379";
var mux = await ConnectionMultiplexer.ConnectAsync(redisConn);
var db = mux.GetDatabase();

// MQTT bağlantısı
string host = Environment.GetEnvironmentVariable("MQTT_HOST") ?? "mqtt";
int port = int.TryParse(Environment.GetEnvironmentVariable("MQTT_PORT"), out var p) ? p : 1883;
var mqtt = new MqttFactory().CreateMqttClient();

// MQTT mesajlarını dinleyip Redis'e kaydet

mqtt.ApplicationMessageReceivedAsync += e => {
  try{
    var t = e.ApplicationMessage.Topic;
  var s = Encoding.UTF8.GetString(e.ApplicationMessage.Payload);
    if(t.StartsWith("sys/metrics/")){
      var id = t[12..]; db.StringSet($"agent:{id}:metrics", s, TimeSpan.FromMinutes(5));
    } else if(t.EndsWith("/output")){
      var id = t.Split('/')[1]; db.StringSet($"agent:{id}:last_output", s, TimeSpan.FromHours(1));
    }
  }catch{}
  return Task.CompletedTask;
};
// Topiclere abone ol
await mqtt.ConnectAsync(new MqttClientOptionsBuilder().WithTcpServer(host, port).Build());
await mqtt.SubscribeAsync("sys/metrics/+");
await mqtt.SubscribeAsync("agent/+/output");

app.UseCors();
app.MapGet("/api/healthz", () => Results.Ok(new{ok=true,utc=DateTime.UtcNow}));

// API endpointleri

app.MapGet("/api/metrics", () => {
  var server = mux.GetServer(mux.GetEndPoints()[0]);
  var res = new Dictionary<string,object?>();
  var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
  foreach(var k in server.Keys(pattern:"agent:*:metrics")){
    var id = k.ToString().Split(':')[1];
    var json = db.StringGet(k);
    if (!json.HasValue) continue;
    try {
      var jsonStr = json.ToString();
      using var doc = JsonDocument.Parse(jsonStr);
      if (doc.RootElement.TryGetProperty("ts", out var tsEl)){
        long ts;
        if (tsEl.ValueKind == JsonValueKind.Number && tsEl.TryGetInt64(out var tsv)) ts = tsv; else ts = 0;
        // 10 saniyeden eski metrikleri yok say
        if (now - ts > 10) continue;
      }
      res[id] = JsonSerializer.Deserialize<object>(jsonStr);
    } catch { /* hatalı veri formatlarını yok say */ }
  }
  return Results.Ok(res);
});

// Belirli bir ajan için son komut çıktısını döner

app.MapGet("/api/output/{id}", (string id) => {
  var v = db.StringGet($"agent:{id}:last_output");
  return v.HasValue ? Results.Text(v!) : Results.NoContent();
});

// Komut çalıştırma isteği alır ve ilgili ajana MQTT üzerinden iletir

app.MapPost("/api/command", async (HttpRequest req) => {
  if (req.ContentLength is 0) return Results.BadRequest();
  var dto = await JsonSerializer.DeserializeAsync<Dictionary<string,string>>(req.Body);
  if(dto is null || !dto.TryGetValue("agentId", out var id) || !dto.TryGetValue("cmd", out var cmd)) return Results.BadRequest();
  // Kullanıcının yazdığı komutu olduğu gibi ajan'a iletiriz (ajan tarafında normalize ediliyor)
  var payload = JsonSerializer.Serialize(new { cmd });
  var msg = new MqttApplicationMessageBuilder()
    .WithTopic($"agent/{id}/command/execute")
    .WithPayload(payload)
    .Build();
  await mqtt.PublishAsync(msg);
  return Results.Accepted();
});

app.Run();
