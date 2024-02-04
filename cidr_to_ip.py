import ipaddress

def expand_cidr(ip):
    try:
        network = ipaddress.ip_network(ip, strict=False)
        return [str(ip) for ip in network]
    except ValueError:
        return [ip]  # Not a valid CIDR, return the original IP

def process_ip_list(file_path):
    expanded_ips = []
    with open(file_path, 'r') as file:
        for line in file:
            ip = line.strip()
            expanded_ips.extend(expand_cidr(ip))
    return expanded_ips

# Prompt the user for the file path
file_path = input("Enter the path to your file: ")
all_ips = process_ip_list(file_path)

# Write the results to a new file
with open('expanded_ip_list.txt', 'w') as file:
    for ip in all_ips:
        file.write(ip + '\n')

print(f"Processed IP addresses are saved in 'expanded_ip_list.txt'")
