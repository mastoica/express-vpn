# ExpressVPN Speed Test

This project provides a command-line tool to test the speed of ExpressVPN connections, compared with a connection without a VPN, using Docker.

## Prerequisites

- Docker installed and running.
- An ExpressVPN activation code.

## Setup

1.  **Clone the repository:**

    git clone https://github.com/mastoica/express-vpn.git
    cd express-vpn

2.  **Create a `.env` file:**

    Copy the contents of `.env.example` to a new file named `.env` and fill in the required values:

    EXPRESSVPN_ACTIVATION_CODE=<your_activation_code>
    SERVER=smart
    PREFERRED_PROTOCOL=auto
    LIGHTWAY_CIPHER=auto

    Replace `<your_activation_code>` with your actual ExpressVPN activation code.

## Simple start

Run the following script

./start.sh

This will build the Docker image and run the container, starting the ExpressVPN service and running the speed test automatically.
At the end of the test, the container will stop and output will be written inside data/output.json files.
For a full result, please check data/output-full.json file.

## Usage

1.  **Build the Docker image:**

    docker-compose build

2.  **Run the Docker container:**

    docker-compose up

    This command will:

    - Start the ExpressVPN service inside the container.
    - Activate ExpressVPN using the provided activation code.
    - Run a speed test with the provided locations from `data/input.json`(please change locations if needed).

3.  **Stop the Docker container:**

    docker-compose down

    This command will:

    - Stop the ExpressVPN service inside the container.

## Notes

- The [docker-compose.yml](cci:7://file:///Users/mastoica/Sites/express-vpn/docker-compose.yml:0:0-0:0) file is configured to run the container in privileged mode and with `NET_ADMIN` capabilities, which are required for ExpressVPN to manage network interfaces.
- The `entrypoint.sh` script handles the activation and connection process.
- The `expressvpnActivate.sh` script automates the ExpressVPN activation process.
