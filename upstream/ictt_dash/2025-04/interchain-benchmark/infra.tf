variable "github_username" {
  description = "GitHub username to fetch SSH keys from"
  type        = string
  default     = "containerman17"
}

variable "instance_count" {
  description = "Number of EC2 instances to create"
  type        = number
  default     = 5
}

provider "aws" {
  alias  = "tokyo"
  region = "ap-northeast-1"
}

resource "aws_security_group" "allow_ssh_tokyo" {
  provider    = aws.tokyo
  name        = "benchmark_2025_04_17"
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

resource "aws_instance" "tokyo-ec2" {
  count                       = var.instance_count
  provider                    = aws.tokyo
  ami                         = "ami-026c39f4021df9abe"
  instance_type               = "m7i.4xlarge"
  vpc_security_group_ids      = [aws_security_group.allow_ssh_tokyo.id]
  associate_public_ip_address = true

  root_block_device {
    volume_size = 150
    volume_type = "gp3"
  }

  user_data = <<-EOF
    #!/bin/bash
    # Setup SSH
    mkdir -p /home/ubuntu/.ssh
    echo '${file("./id_ed25519.pub")}' >> /home/ubuntu/.ssh/authorized_keys
    curl https://github.com/${var.github_username}.keys >> /home/ubuntu/.ssh/authorized_keys
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

  tags = {
    Name = "${var.github_username}-terraform-${count.index + 1}"
  }
}

output "public_ips" {
  value = {
    for idx, instance in aws_instance.tokyo-ec2 :
    "${idx + 1}" => instance.public_ip
  }
  description = "Public IPs of all tokyo EC2 instances"
}
