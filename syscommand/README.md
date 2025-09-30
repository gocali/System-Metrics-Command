# SysCommand (Tek Klasör)

## Çalıştırma

```bash
cd syscommand
./start.sh
```

- Reverse Proxy: [http://127.0.0.1:8080](http://127.0.0.1:8080) (Frontend buradan servis edilir)
- Backend API: [http://127.0.0.1:2025/api/healthz](http://127.0.0.1:2025/api/healthz)
- MQTT (TCP): 127.0.0.1:1657 | WS: ws://127.0.0.1:1453/mqtt
- Redis: 127.0.0.1:1999

> Not: Docker izni yoksa bir kez: `sudo usermod -aG docker $USER && newgrp docker`

## WSL ile Çalıştırma

İki yol vardır:

1. Docker Desktop + WSL Entegrasyonu (Önerilir):

- Docker Desktop Settings → General: "Use the WSL 2 based engine" açık.
- Settings → Resources → WSL Integration: Ubuntu dağıtımı Enabled.
- WSL terminalinde projeye gidip `./start.sh` çalıştırın.

2. WSL içine Native Docker Kurmak (Docker Desktop olmadan):

> Not: WSL’de systemd aktif değilse Docker servisini yönetmek zorlaşır. En güncel WSL’de systemd açılabiliyor.

### Systemd açma (önerilir)

WSL Ubuntu içinde `/etc/wsl.conf` dosyasını aşağıdaki gibi oluşturun/güncelleyin:

```
[boot]
systemd=true
```

Ardından Windows’ta WSL’i yeniden başlatın:

```powershell
wsl --shutdown
```

WSL’i tekrar açın ve aşağıdaki kurulumu yapın.

### Docker Engine kurulumu (resmi depo)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
	"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
	$(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
	sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Kullanıcıyı docker grubuna ekleyin
sudo usermod -aG docker $USER
# Grup üyeliğinin etkin olması için yeni shell açın
newgrp docker

# Doğrulama
docker --version
docker compose version
```

### Projeyi çalıştırma (WSL içinde)

```bash
cd /mnt/c/Users/gocali/Desktop/syscommand
./start.sh
```

Erişim:

- Frontend (Nginx): http://localhost:8080
- Backend: http://localhost:2025/api/healthz
- MQTT WS: ws://localhost:1453/mqtt

Eğer Windows’tan `localhost` erişimi olmazsa (nadir), `docker-compose.yml` içindeki port yayınlarında `127.0.0.1:` kısmını kaldırıp sadece `8080:8080` şeklinde kullanın.

## Mimari

Agent → MQTT → Backend (Redis’e yazar, REST sunar) → Nginx → Frontend

## Windows/WSL’de CPU ve RAM farkı neden olabilir?

Bu proje Linux konteynerlerinde çalışır. Windows’ta Docker Desktop kullanıyorsanız, konteynerler WSL2 Linux VM’i içinde koşar. Dolayısıyla ajan (`agent`) metrikleri Linux tarafındaki kaynaklara göre ölçer. Windows Görev Yöneticisi (Task Manager) ise Windows host’un kaynaklarını gösterir; bu ikisi bire bir aynı değildir.

Örnek farklar:

- RAM: WSL2 VM’in RAM kullanımı, Windows toplam RAM’den farklı olabilir. Ajan varsayılan olarak Linux VM’in (konteynerin gördüğü) toplam RAM’ine göre yüzde hesaplar.
- CPU: Linux tarafındaki CPU yüzdesi, Windows’un CPU hesaplamasından farklı normalize edilebilir.

Yaklaşımlar:

- Mevcut yapılandırmada `agent` servisi `pid: host` ile çalıştırılır; böylece WSL VM içindeki host PID ve bazı istatistiklere daha yakından erişerek daha gerçekçi metrik üretir.
- Windows Task Manager ile bire bir karşılaştırmak istiyorsanız, ajanı doğrudan Windows üzerinde (Python ile) çalıştırmanız gerekir. Bunun için Docker yerine yerelde `python agent/agent.py` çalıştırıp `MQTT_HOST` olarak Docker’daki `mqtt` servisine erişen IP’yi/yönlendirmeyi ayarlayın.

## Komut Çalıştırma

Frontend’ten seçip gönderin. Agent yalnızca `ALLOWED` sözlüğündeki komutları çalıştırır (güvenlik). Yeni komut eklemek için `agent/agent.py` içinde `ALLOWED["isim"] = "shell"` ekleyin.

### Agent içinde Docker komutları

`agent` imajı artık Docker CLI içerir (bkz. `agent/Dockerfile`). `docker ps` vb. komutların çalışabilmesi için:

- Host Docker daemon erişimi gerekir. Bunun için compose dosyasında `/var/run/docker.sock` bind mount yapılmıştır.
- Güvenlik uyarısı: Docker socket paylaşımı konteynerin host üzerinde güçlü yetkiler almasına yol açar. Sadece güvenilir ortamlarda kullanın.
