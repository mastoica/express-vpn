FROM debian:bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    unzip \
    libterm-readkey-perl \ 
    ca-certificates \
    expect \
    iproute2 \
    procps \
    libnm0 \
    gnupg \
    build-essential python3 \
    && rm -rf /var/lib/apt/lists/*

ARG APP=expressvpn_3.82.0.2-1_amd64.deb

RUN wget -q https://deb.nodesource.com/setup_20.x -O - | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest

RUN wget -q "https://www.expressvpn.works/clients/linux/${APP}" -O /tmp/${APP} \
    && dpkg -i /tmp/${APP} \
    && rm -rf /tmp/*.deb \
    && apt-get purge -y --auto-remove wget

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

RUN rm -rf dist/
RUN npm run build

COPY entrypoint.sh /tmp/entrypoint.sh
COPY expressvpnActivate.sh /tmp/expressvpnActivate.sh

ENTRYPOINT ["/bin/bash", "/tmp/entrypoint.sh"]
