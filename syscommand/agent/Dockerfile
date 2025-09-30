# Docker CLI mevcut olan Agent imajı
FROM python:3.12-slim

# Docker'ın resmi APT deposundan Docker CLI + Compose v2 kur (Debian trixie)
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg tini; \
    install -m 0755 -d /etc/apt/keyrings; \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc; \
    chmod a+r /etc/apt/keyrings/docker.asc; \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python bağımlılıklarını önceden kur (katmanlı)
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# İsteğe bağlı olarak kaynak kodu kopyala (bind mount çalışma zamanında geçersiz kılacak)
# COPY agent.py /app/agent.py

# tini'yi init olarak kullan (compose ayrıca init: true ayarlar ama bu imajı kendi kendine yeten tutar)
ENTRYPOINT ["tini", "--"]
CMD ["python", "-u", "agent.py"]
