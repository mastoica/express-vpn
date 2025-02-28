# ExpressVPN Speed Test

This project provides a command-line tool to test the speed of ExpressVPN connections compared with a connection without a VPN, using Docker.

## Prerequisites

- Docker installed and running
- An ExpressVPN activation code

## Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/mastoica/express-vpn.git
   cd express-vpn
   ```

2. **Create a `.env` file:**

   Copy the contents of `.env.example` to a new file named `.env` and fill in the required values:

   ```bash
   EXPRESSVPN_ACTIVATION_CODE=<your_activation_code>
   SERVER=smart
   PREFERRED_PROTOCOL=auto
   LIGHTWAY_CIPHER=auto
   ```

   Replace `<your_activation_code>` with your actual ExpressVPN activation code.

## Simple Start

Run the following script:

```bash
./start.sh
```

This will build the Docker image and run the container, starting the ExpressVPN service and running the speed test automatically.
At the end of the test, the container will stop and output will be written inside `data/output.json` files.
For a full result, please check the `data/output-full.json` file.

## Manual Usage

1. **Build the Docker image:**

   ```bash
   docker compose build
   ```

2. **Run the Docker container:**

   ```bash
   docker compose up express-vpn
   ```

   This command will:

   - Start the ExpressVPN service inside the container
   - Activate ExpressVPN using the provided activation code
   - Run a speed test with the provided locations from `data/input.json` (please change locations if needed)

3. **Stop the Docker container:**

   ```bash
   docker compose down
   ```

   This command will stop the ExpressVPN service inside the container.

## How It Works

The tool performs the following steps:

1. Runs a baseline speed test without VPN connection
2. Connects to each VPN location specified in your input file
3. Runs 5 speed tests for each location to get accurate average values
4. Compares the results to show how VPN affects your connection performance

## Configuration

You can customize the test by editing the `data/input.json` file with your preferred VPN locations:

```json
{
  "locations": [
    { "country": "USA", "city": "New York" },
    { "country": "UK", "city": "London" },
    { "country": "Germany", "city": "Frankfurt" }
  ]
}
```

## Notes

- The `docker-compose.yml` file is configured to run the container in privileged mode and with `NET_ADMIN` capabilities, which are required for ExpressVPN to manage network interfaces
- The `entrypoint.sh` script handles the activation and connection process
- The `expressvpnActivate.sh` script automates the ExpressVPN activation process

## License

MIT
