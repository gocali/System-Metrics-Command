sudo service docker start
sudo systemctl enable docker

#!/usr/bin/env bash
set -euo pipefail
# İzinler
find . -maxdepth 2 -type f -name "*.sh" -exec chmod +x {} \;
# (Gerekliyse) kullanıcıyı docker grubuna ekleme notu:
# sudo usermod -aG docker "$USER" && newgrp docker

echo "[+] Containers building & starting..."
docker compose pull || true
docker compose up -d --build

echo "[✓] Up. Reverse proxy: http://127.0.0.1:8080"
echo "    Frontend: http://127.0.0.1:8080/
    Backend API: http://127.0.0.1:2025/api/healthz
    MQTT TCP: 127.0.0.1:1657  | WS: ws://127.0.0.1:1453/mqtt
    Redis: 127.0.0.1:1999"
