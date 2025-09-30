import os,json,time,socket,subprocess,getpass
import psutil
import paho.mqtt.client as mqtt

AGENT_ID = os.getenv("AGENT_ID", socket.gethostname())
HOST = os.getenv("MQTT_HOST", "localhost")
PORT = int(os.getenv("MQTT_PORT", "1883"))
AGENT_NAME = (
  os.getenv("AGENT_NAME")
  or os.getenv("USER")
  or os.getenv("USERNAME")
  or (getattr(getpass, "getuser", lambda: None)() or None)
  or AGENT_ID
)

COMMANDS: dict[str, tuple[str, object]] = {
  # Python-yerel yardımcı program
  "netinfo": ("python", None),
  # Shell yardımcı programları
  "docker ps": ("shell", "docker ps"),
  "docker compose ps": ("shell", "docker compose ps"),
  "docker --version": ("shell", "docker --version"),
  "lshw": ("shell", "lshw"),
  "lsblk": ("shell", "lsblk"),
  "df -h": ("shell", "df -h"),
  "uptime": ("shell", "uptime"),
  "free -h": ("shell", "free -h"),
  "ps aux": ("shell", "ps aux --sort=-%mem | head -n 10"),
  "who": ("shell", "who"),
  "last": ("shell", "last -n 5"),
  "ip a": ("shell", "ip a"),
  "ip r": ("shell", "ip r"),
  "ss -tuln": ("shell", "ss -tuln"),
  "netstat -tuln": ("shell", "netstat -tuln"),
  "systemctl list-units --type=service --state=running": ("shell", "systemctl list-units --type=service --state=running"),
  "journalctl -n 20 --no-pager": ("shell", "journalctl -n 20 --no-pager"),
  "cat /etc/os-release": ("shell", "cat /etc/os-release"),
  "uname -a": ("shell", "uname -a"),
  "cat /proc/cpuinfo": ("shell", "cat /proc/cpuinfo | head -n 10"),
  "cat /proc/meminfo": ("shell", "cat /proc/meminfo | head -n 10"),
  "env": ("shell", "env"),
  "whoami": ("shell", "whoami"),
  "id": ("shell", "id"),
  "pwd": ("shell", "pwd"),
  "ls -la": ("shell", "ls -la"),
  "ps -ef": ("shell", "ps -ef | head -n 10"),
  "crontab -l": ("shell", "crontab -l"),
  "df -h": ("shell", "df -h"),
  "mount": ("shell", "mount | head -n 10"),
  "ipcs -a": ("shell", "ipcs -a"),
  "ss -s": ("shell", "ss -s"),
  "iptables -L": ("shell", "iptables -L"),
  "route -n": ("shell", "route -n"),

  "ping -c 4": ("shell", "ping -c 4 google.com"),
  
  # Advanced System Tools
  "ncdu": ("shell", "ncdu --help || echo 'ncdu not installed'"),
  "duff": ("shell", "duff --help || echo 'duff not installed'"),
  "rg --version": ("shell", "rg --version || echo 'ripgrep not installed'"),
  "mosh --version": ("shell", "mosh --version || echo 'mosh not installed'"),
  "mtr --version": ("shell", "mtr --version || echo 'mtr not installed'"),
  "fd --version": ("shell", "fd --version || echo 'fd not installed'"),
  "fzf --version": ("shell", "fzf --version || echo 'fzf not installed'"),
  "ranger --version": ("shell", "ranger --version || echo 'ranger not installed'"),
  "zoxide --version": ("shell", "zoxide --version || z --version || echo 'zoxide/z not installed'"),
  "exa --version": ("shell", "exa --version || echo 'exa not installed'"),
  "glances --version": ("shell", "glances --version || echo 'glances not installed'"),
  "iotop --version": ("shell", "iotop --version || echo 'iotop not installed'"),
  "stat --version": ("shell", "stat --version"),
  "watch --version": ("shell", "watch --version"),
  "progress --version": ("shell", "progress --version || echo 'progress not installed'"),
  "dig -v": ("shell", "dig -v || echo 'dig not installed'"),
  "dog --version": ("shell", "dog --version || echo 'dog not installed'"),
  "lsof -v": ("shell", "lsof -v || echo 'lsof not installed'"),
  "ipcalc --version": ("shell", "ipcalc --version || echo 'ipcalc not installed'"),
  "wormhole --version": ("shell", "wormhole --version || echo 'magic-wormhole not installed'"),
  "procs --version": ("shell", "procs --version || echo 'procs not installed'"),
  "lazydocker --version": ("shell", "lazydocker --version || echo 'lazydocker not installed'"),
  "jq --version": ("shell", "jq --version || echo 'jq not installed'"),
  "asciinema --version": ("shell", "asciinema --version || asc --version || echo 'asciinema not installed'"),
  
  # System Analysis
  "systemd-analyze blame": ("shell", "systemd-analyze blame | head -n 10"),
  "systemd-analyze critical-chain": ("shell", "systemd-analyze critical-chain"),
  
  # Process Management  
  "procs": ("shell", "procs || ps aux | head -n 15"),
  
  # Network Tools
  "tcpdump --version": ("shell", "tcpdump --version || echo 'tcpdump not installed'"),
  "tshark --version": ("shell", "tshark --version || echo 'tshark/wireshark not installed'"),
  "termshark --version": ("shell", "termshark --version || echo 'termshark not installed'"),
  
  # File Operations
  "rsync --version": ("shell", "rsync --version"),
  "shred --version": ("shell", "shred --version"),
  
  # Utilities
  "ts --version": ("shell", "ts --version || echo 'moreutils not installed'"),
  "errno": ("shell", "errno --help || echo 'errno not installed'"),
  "ifdata --version": ("shell", "ifdata --version || echo 'ifdata not installed'"),
  "vidir --version": ("shell", "vidir --version || echo 'vidir/moreutils not installed'"),
  "unp --version": ("shell", "unp --version || echo 'unp not installed'"),
  
  # Task Management
  "task --version": ("shell", "task --version || echo 'taskwarrior not installed'"),
  
  # Development Tools
  "fabric --version": ("shell", "fabric --version || echo 'fabric not installed'"),
  "ollama --version": ("shell", "ollama --version || echo 'ollama not installed'"),
  
  # File System Analysis
  "ncdu /": ("shell", "timeout 10 ncdu --one-file-system / 2>/dev/null | head -n 20 || echo 'ncdu analysis timeout or not installed'"),
  "duff -r .": ("shell", "timeout 10 duff -r . 2>/dev/null | head -n 10 || echo 'duff not available'"),
  
  # Search & Find
  "rg --files": ("shell", "timeout 5 rg --files . 2>/dev/null | head -n 20 || find . -type f 2>/dev/null | head -n 20"),
  "fd .": ("shell", "timeout 5 fd . 2>/dev/null | head -n 20 || find . 2>/dev/null | head -n 20"),
  
  # System Monitoring
  "glances -t 1": ("shell", "timeout 3 glances -t 1 --stdout || top -bn1 | head -n 20"),
  "iotop -a -o -d 1 -n 1": ("shell", "timeout 2 iotop -a -o -d 1 -n 1 2>/dev/null || echo 'iotop requires root or not installed'"),
  
  # Network Monitoring
  "mtr -c 3 google.com": ("shell", "timeout 10 mtr -c 3 google.com 2>/dev/null || traceroute google.com 2>/dev/null | head -n 10"),
  
  # Docker Management
  "lazydocker": ("shell", "timeout 5 lazydocker --help 2>/dev/null | head -n 10 || docker ps"),
  
}

#-----------------------------------SNAPSHOT (sistem metrikleri)

def _snapshot(cpu_avg: float | None = None):
  vm = psutil.virtual_memory()
  now = int(time.time())
  # Kararlılık için 0.1'e yuvarla
  def r01(x: float) -> float:
    return round(float(x), 1)

  cpu_mean = cpu_avg if cpu_avg is not None else float(psutil.cpu_percent(interval=None))

  try:
    used_incl_cache = vm.total - vm.free
    mem_pct = (used_incl_cache / vm.total) * 100.0 if vm.total else vm.percent
  except Exception:
    mem_pct = vm.percent

  payload = {
    "agentId": AGENT_ID,
    "name": AGENT_NAME,
    "hostname": socket.gethostname(),
    "cpu": r01(cpu_mean),
    "ram": r01(mem_pct),
    "ts": now,
  }
  # mqtt komut topiğine abone oluyor
  payload["memUsedPct"] = r01(mem_pct)
  return payload

#-----------------------------------NET INFO

def on_connect(client, userdata, flags, rc, props=None):
  client.subscribe(f"agent/{AGENT_ID}/command/execute")

def _netinfo_text() -> str:
  lines = [f"agent: {AGENT_ID}", f"host: {socket.gethostname()}"]
  stats = psutil.net_if_stats()
  addrs = psutil.net_if_addrs()
  for iface in sorted(addrs.keys()):
    s = stats.get(iface)
    lines.append("")
    lines.append(f"[{iface}] up={getattr(s,'isup',None)} mtu={getattr(s,'mtu',None)} speed={getattr(s,'speed',None)}")
    for a in addrs[iface]:
      fam = str(a.family).split('.')[-1]
      if fam.endswith("AF_PACKET") or fam.endswith("AF_LINK"):
        lines.append(f"  mac:   {a.address}")
      elif fam.endswith("AF_INET"):
        lines.append(f"  ipv4:  {a.address} mask={a.netmask} bcast={a.broadcast}")
      elif fam.endswith("AF_INET6"):
        lines.append(f"  ipv6:  {a.address} scope={a.broadcast} mask={a.netmask}")
  return "\n".join(lines)[:4000]

#-----------------------------------COMMAND HANDLER
# Gelen komutları parse ediyor
# İzin verilen komutları çalıştırıyor
# Sonuçları MQTT'ye gönderiyor

def on_message(client, userdata, msg):
  try:
    data = json.loads(msg.payload.decode())
    raw = str(data.get("cmd", ""))
    key = raw.strip().lower()

    # Komutu çöz
    entry = COMMANDS.get(key)
    if not entry:
      out = "command not allowed"
    else:
      mode, target = entry
      if mode == "python":
        out = _netinfo_text()
      elif mode == "shell":
        res = subprocess.run(str(target), shell=True, capture_output=True, text=True, timeout=15)
        out = (res.stdout or res.stderr)[:4000]
      else:
        out = "command not allowed"
  except Exception as e:
    out = f"error: {e}"
  client.publish(f"agent/{AGENT_ID}/output", out, qos=0, retain=False)

#-----------------------------------ANA DÖNGÜ
#Her saniye sistem metriklerini gönderiyor
#CPU ölçümü 1 saniyelik interval ile

def main() -> None:
  cli = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"agent-{AGENT_ID}")
  cli.on_connect = on_connect
  cli.on_message = on_message
  cli.connect(HOST, PORT, keepalive=30)
  cli.loop_start()

  try:
    # İlk okuma doğruluğunu artırmak için CPU ölçüm temelini hazırla
    psutil.cpu_percent(interval=None)
    while True:
      # Daha iyi doğruluk için CPU'yu tam 1 saniyelik aralıkta ölç
      avg = float(psutil.cpu_percent(interval=1.0))
      payload = json.dumps(_snapshot(avg))
      cli.publish(f"sys/metrics/{AGENT_ID}", payload, qos=0, retain=False)
  except KeyboardInterrupt:
    pass
  finally:
    cli.loop_stop()
    cli.disconnect()


if __name__ == "__main__":
  main()
