#!/bin/bash

# Configuration
SERVICE_LABEL="com.thali.printerbridge"
PLIST_PATH="$HOME/Library/LaunchAgents/$SERVICE_LABEL.plist"
CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NODE_PATH=$(which node)

# Check if Node is found
if [ -z "$NODE_PATH" ]; then
    # Try common locations if 'which' fails (e.g. if run from a context with limited path)
    if [ -f "/usr/local/bin/node" ]; then
        NODE_PATH="/usr/local/bin/node"
    elif [ -f "/opt/homebrew/bin/node" ]; then
        NODE_PATH="/opt/homebrew/bin/node"
    else
        echo "Error: Node.js not found. Please install Node.js first."
        exit 1
    fi
fi

echo "Setting up Printer Bridge at: $CURRENT_DIR"
echo "Using Node.js at: $NODE_PATH"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Create Property List file
cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$SERVICE_LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>$CURRENT_DIR/server.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$CURRENT_DIR/bridge.log</string>
    <key>StandardErrorPath</key>
    <string>$CURRENT_DIR/bridge-error.log</string>
    <key>WorkingDirectory</key>
    <string>$CURRENT_DIR</string>
</dict>
</plist>
EOF

echo "Created Launch Agent at: $PLIST_PATH"

# Unload if exists, then load
launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"

echo "✅ Printer Bridge Service Installed!"
echo "It will now start automatically whenever you log in."
echo "You can check logs at: tail -f bridge.log"
