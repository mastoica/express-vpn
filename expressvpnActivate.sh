#!/usr/bin/expect

spawn expressvpn activate
expect {
    "code:" {
        send "$env(EXPRESSVPN_ACTIVATION_CODE)\r"
        expect "information."
        send "n\r"
    }
    "Already activated. Logout from your account (y/N)" {
        send "\r"
    }
}
expect eof