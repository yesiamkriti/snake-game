# create Ec2 instance, variables, and output
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.92"
    }
    tls = {
      source = "hashicorp/tls"
    }
    local = {
      source = "hashicorp/local"
    }
  }
}

provider "aws" {
  region = "eu-north-1"
}
resource "aws_vpc" "main_vpc" {
  cidr_block = "10.0.0.0/16"
  tags = {
    Name = "main-vpc"
  }
}
resource "aws_subnet" "main_subnet" {
  vpc_id                  = aws_vpc.main_vpc.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true
  availability_zone       = "eu-north-1a"

  tags = {
    Name = "main-subnet"
  }
}
resource "aws_internet_gateway" "main_igw" {
  vpc_id = aws_vpc.main_vpc.id

  tags = {
    Name = "main-igw"
  }
}

resource "aws_route_table" "main_rt" {
  vpc_id = aws_vpc.main_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main_igw.id
  }

  tags = {
    Name = "main-rt"
  }
}

resource "aws_route_table_association" "main_assoc" {
  subnet_id      = aws_subnet.main_subnet.id
  route_table_id = aws_route_table.main_rt.id
}
resource "aws_security_group" "jenkins_sg" {
  name        = "jenkins-sg"
  vpc_id      = aws_vpc.main_vpc.id
  description = "Allow SSH and Jenkins UI"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Jenkins UI"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "jenkins-sg"
  }
}

# # App EC2 SG (allow 22, 80, 5000)
resource "aws_security_group" "app_sg" {
  name        = "app-sg"
  vpc_id      = aws_vpc.main_vpc.id
  description = "Allow web traffic and SSH"

  ingress {
    description = "SSH from Jenkins"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # you can restrict this later
  }

  ingress {
    description = "Frontend HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Backend API"
    from_port   = 5000
    to_port     = 5000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "app-sg"
  }
}
# i am role for ec2 (ecr access)
resource "aws_iam_role" "ec2_role" {
  name = "ec2-ecr-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "ec2.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecr_access" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess"
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "ec2-ecr-instance-profile"
  role = aws_iam_role.ec2_role.name
}

# 1. Generate an RSA private key
resource "tls_private_key" "ec2_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# 2. Save the generated private key to a local file
resource "local_sensitive_file" "pem_file" {
  filename             = "${path.module}/ec2-key.pem" # Saves the file in the current module directory
  content              = tls_private_key.ec2_key.private_key_pem
  file_permission      = "0600" # Sets secure file permissions (read/write for owner only)
  directory_permission = "0700"
}

# 3. Create an AWS key pair resource using the public key part
resource "aws_key_pair" "generated_key_pair" {
  key_name   = "generated-key-pair"
  public_key = tls_private_key.ec2_key.public_key_openssh
}

# Jenkins EC2
resource "aws_instance" "jenkins_server" {
  ami                         = "ami-055e4d03ab1de5def" # Amazon Linux 2023
  instance_type               = "t3.micro"
  subnet_id                   = aws_subnet.main_subnet.id
  vpc_security_group_ids      = [aws_security_group.jenkins_sg.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2_profile.name
  key_name                    = aws_key_pair.generated_key_pair.key_name
  associate_public_ip_address = true

  user_data = <<-EOF
                #!/bin/bash
                yum update -y
                dnf install java-17-amazon-corretto -y
                yum install -y docker git
                systemctl enable docker
                systemctl start docker
                usermod -aG docker ec2-user
                wget -O /etc/yum.repos.d/jenkins.repo https://pkg.jenkins.io/redhat-stable/jenkins.repo
                rpm --import https://pkg.jenkins.io/redhat-stable/jenkins.io-2023.key
                yum install -y jenkins
                usermod -aG docker jenkins
                systemctl enable jenkins
                systemctl start jenkins
                EOF


  tags = {
    Name = "jenkins-server"
  }
}

# App Deployment EC2
resource "aws_instance" "app_server" {
  ami                         = "ami-055e4d03ab1de5def"
  instance_type               = "t3.micro"
  subnet_id                   = aws_subnet.main_subnet.id
  vpc_security_group_ids      = [aws_security_group.app_sg.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2_profile.name
  key_name                    = aws_key_pair.generated_key_pair.key_name
  associate_public_ip_address = true

  user_data = <<-EOF
              #!/bin/bash
              yum update -y
              yum install -y docker git
              systemctl enable docker
              systemctl start docker
              usermod -aG docker ec2-user
              EOF

  tags = {
    Name = "app-server"
  }
}

# ############################
# # ECR REPOSITORIES
# ############################
resource "aws_ecr_repository" "frontend_repo" {
  name = "frontend-repo"
}

resource "aws_ecr_repository" "backend_repo" {
  name = "backend-repo"
}

