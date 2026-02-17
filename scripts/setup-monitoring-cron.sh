#!/bin/bash

# Automatic Monitoring Cron Job Setup Script
# This script helps you set up automatic monitoring for your status page

echo "=== Status Page Monitoring Setup ==="
echo ""

# Get the status page URL
read -p "Enter your status page URL (e.g., https://status.example.com): " STATUS_URL

# Validate URL
if [[ ! $STATUS_URL =~ ^https?:// ]]; then
    echo "Error: Invalid URL. Must start with http:// or https://"
    exit 1
fi

# Remove trailing slash
STATUS_URL=${STATUS_URL%/}

echo ""
echo "Testing monitoring endpoint..."

# Test the endpoint
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$STATUS_URL/api/monitoring/check")

if [ "$HTTP_CODE" != "200" ]; then
    echo "Warning: Monitoring endpoint returned HTTP $HTTP_CODE"
    echo "Make sure your status page is running and accessible"
    read -p "Continue anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        exit 1
    fi
fi

echo ""
echo "Select monitoring interval:"
echo "1) Every minute (recommended)"
echo "2) Every 2 minutes"
echo "3) Every 5 minutes"
echo "4) Every 10 minutes"
read -p "Choice (1-4): " INTERVAL

case $INTERVAL in
    1) CRON_SCHEDULE="* * * * *" ;;
    2) CRON_SCHEDULE="*/2 * * * *" ;;
    3) CRON_SCHEDULE="*/5 * * * *" ;;
    4) CRON_SCHEDULE="*/10 * * * *" ;;
    *) echo "Invalid choice"; exit 1 ;;
esac

echo ""
echo "Creating cron job..."

# Create cron entry
CRON_COMMAND="curl -s -X GET '$STATUS_URL/api/monitoring/check' > /dev/null 2>&1"
CRON_ENTRY="$CRON_SCHEDULE $CRON_COMMAND"

# Add to crontab
(crontab -l 2>/dev/null | grep -v "$STATUS_URL/api/monitoring/check"; echo "$CRON_ENTRY") | crontab -

echo ""
echo "✓ Cron job installed successfully!"
echo ""
echo "Cron schedule: $CRON_SCHEDULE"
echo "Command: $CRON_COMMAND"
echo ""
echo "To view your crontab:"
echo "  crontab -l"
echo ""
echo "To remove this cron job:"
echo "  crontab -e"
echo "  (then delete the line containing: $STATUS_URL/api/monitoring/check)"
echo ""
echo "Note: Make sure your services are configured with monitoring URLs in the admin panel."
