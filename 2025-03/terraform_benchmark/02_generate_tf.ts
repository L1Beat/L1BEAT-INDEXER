#! /usr/bin/env bun

import { regions, instancesPerRegion, githubUsername } from "./00_values.ts";

const shared = `
locals {
  ssh_public_key = file("./id_ed25519.pub")
  user_data      = <<-EOF
    #!/bin/bash
    # Setup SSH
    mkdir -p /home/ubuntu/.ssh
    echo '\${file("./id_ed25519.pub")}' >> /home/ubuntu/.ssh/authorized_keys
    curl https://github.com/${githubUsername}.keys >> /home/ubuntu/.ssh/authorized_keys
    chmod 600 /home/ubuntu/.ssh/authorized_keys
    chown ubuntu:ubuntu /home/ubuntu/.ssh/authorized_keys

    # Install Docker
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Post-installation steps to use Docker without sudo
    usermod -aG docker ubuntu
    
    # Enable and start Docker service
    systemctl enable docker
    systemctl start docker
  EOF
}
`;

const regionConfig = (region: string, regionName: string, ami: string, instancesPerRegion: number) => {
  let config = `
provider "aws" {
  alias  = "${regionName}"
  region = "${region}"
}


resource "aws_security_group" "allow_ssh_${regionName}" {
  provider    = aws.${regionName}
  name        = "benchmark_2025_03_25"
  description = "Allow SSH, HTTPS, 9650, 9651 and ping"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 9650
    to_port     = 9650
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 9651
    to_port     = 9651
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = -1
    to_port     = -1
    protocol    = "icmp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

`;

  // Generate multiple instances based on instancesPerRegion
  for (let i = 0; i < instancesPerRegion; i++) {
    const instanceSuffix = i > 0 ? `-${i + 1}` : "";

    config += `
# ${regionName} instance${instanceSuffix}
resource "aws_instance" "${regionName}-ec2${instanceSuffix}" {
  provider                    = aws.${regionName}
  ami                         = "${ami}"
  instance_type               = "m7i.4xlarge"
  vpc_security_group_ids      = [aws_security_group.allow_ssh_${regionName}.id]
  associate_public_ip_address = true

  root_block_device {
    volume_size = 150
    volume_type = "gp3"
  }

  user_data = local.user_data

  tags = {
    Name = "terraform-ec2-${regionName}${instanceSuffix}"
  }
}

output "${regionName}_instance${instanceSuffix}_public_ip" {
  value       = aws_instance.${regionName}-ec2${instanceSuffix}.public_ip
  description = "Public IP of the ${regionName} EC2 instance${instanceSuffix}"
}
`;
  }

  return config;
};


import fs from "fs";

let outFile = shared;
for (const region of regions) {
  outFile += regionConfig(region.region, region.regionName, region.ami, instancesPerRegion);
}


fs.writeFileSync("03_infra.tf", outFile);
