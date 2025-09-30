# SysCommand (Single Folder)

## Running

```bash
cd syscommand
./start.sh
```

- Reverse Proxy: [http://127.0.0.1:8080](http://127.0.0.1:8080) (Frontend is served here)
- Backend API: [http://127.0.0.1:2025/api/healthz](http://127.0.0.1:2025/api/healthz)
- MQTT (TCP): 127.0.0.1:1657 | WS: ws://127.0.0.1:1453/mqtt
- Redis: 127.0.0.1:1999

> Note: If you don't have Docker permission, run once: `sudo usermod -aG docker $USER && newgrp docker`

## Running with WSL

There are two ways:

1. Docker Desktop + WSL Integration (Recommended):

- Docker Desktop Settings → General: "Use the WSL 2 based engine" enabled.
- Settings → Resources → WSL Integration: Ubuntu distribution Enabled.
- Go to the project in the WSL terminal and run `./start.sh`.

2. Installing Native Docker in WSL (without Docker Desktop):

> Note: If systemd is not active in WSL, managing the Docker service becomes harder. In the latest WSL, systemd can be enabled.

### Enabling systemd (recommended)

Create/update `/etc/wsl.conf` in WSL Ubuntu as follows:

```
[boot]
systemd=true
```

Then restart WSL in Windows:

```powershell
wsl --shutdown
```

Reopen WSL and perform the installation below.

### Installing Docker Engine (official repo)

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

# Add user to docker group
sudo usermod -aG docker $USER
# Open a new shell for group membership to take effect
newgrp docker

# Verification
docker --version
docker compose version
```

### Running the project (inside WSL)

```bash
cd /mnt/c/Users/gocali/Desktop/syscommand
./start.sh
```

Access:

- Frontend (Nginx): http://localhost:8080
- Backend: http://localhost:2025/api/healthz
- MQTT WS: ws://localhost:1453/mqtt

If you cannot access `localhost` from Windows (rare), remove `127.0.0.1:` from port publishing in `docker-compose.yml` and use just `8080:8080`.

            ## Architecture

            Agent → MQTT → Backend (writes to Redis, serves REST) → Nginx → Frontend

            ## Why might CPU and RAM differ on Windows/WSL?

            This project runs in Linux containers. If you use Docker Desktop on Windows, containers run inside the WSL2 Linux VM. Thus, the agent (`agent`) measures metrics according to resources on the Linux side. Windows Task Manager shows the host's resources; these are not exactly the same.

            Example differences:

            - RAM: WSL2 VM's RAM usage may differ from Windows' total RAM. By default, the agent calculates percentages based on the total RAM seen by the Linux VM (container).
            - CPU: CPU percentage on the Linux side may be normalized differently than Windows.

            Approaches:

            - In the current configuration, the `agent` service runs with `pid: host`; thus, it can access host PID and some statistics inside the WSL VM for more realistic metrics.
            - If you want to compare directly with Windows Task Manager, run the agent directly on Windows (with Python). For this, run `python agent/agent.py` locally instead of Docker, and set `MQTT_HOST` to the IP/forwarding of the Docker `mqtt` service.

            ## Command Execution

            Select and send from the frontend. The agent only executes commands in the `ALLOWED` dictionary (for security). To add a new command, add `ALLOWED["name"] = "shell"` in `agent/agent.py`.

            ### Docker commands inside Agent

            The `agent` image now includes Docker CLI (see `agent/Dockerfile`). For commands like `docker ps` to work:

            - Host Docker daemon access is required. For this, `/var/run/docker.sock` is bind-mounted in the compose file.
            - Security warning: Sharing the Docker socket gives the container strong privileges on the host. Use only in trusted environments.
