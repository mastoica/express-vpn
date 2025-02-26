FROM ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest

RUN curl -O https://www.expressvpn.works/clients/linux/expressvpn-linux-universal-4.0.0.9224.run \
    && chmod +x expressvpn-linux-universal-4.0.0.9224.run \
    && ./expressvpn-linux-universal-4.0.0.9224.run --target /expressvpn-files --noexec \
    && cp -r /expressvpn-files/* / \
    && rm -rf /expressvpn-files expressvpn-linux-universal-4.0.0.9224.run

RUN ln -s /usr/bin/expressvpn /usr/local/bin/expressvpn

RUN apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

CMD ["node", "dist/main"]
