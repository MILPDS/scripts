#!/bin/bash

# Check if the JSON file path is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <path_to_json_file>"
    exit 1
fi

json_file=$1

# Check if the JSON file exists
if [ ! -f "$json_file" ]; then
    echo "File not found: $json_file"
    exit 1
fi

echo "Using JSON file: $json_file"

output_file="extracted_hosts.txt"
echo "Extracting hosts from the JSON file, cleaning them, and removing duplicates before saving to $output_file..."

# Process the JSON file
jq -r '.target.scope.include[] | select(.enabled == true) | .host' "$json_file" | \
sed -e 's/\\//g' \
    -e 's/\^\.\+\\\./^/' \
    -e 's/\^//' \
    -e 's/\$$//' \
    -e 's/^\.+//' \
    -e 's/\.+/\./g' | \
awk '{print "https://" $0 "/"}' | \
grep -v '^https://\.' | \
sort | uniq > "$output_file"

# Confirmation message
if [ -s "$output_file" ]; then
    echo "Extraction complete. Clean hosts saved to $output_file"
else
    echo "No enabled hosts found or the file is empty."
fi
