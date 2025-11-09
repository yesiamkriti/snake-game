pipeline {
    agent any

    environment {
        AWS_REGION     = 'eu-north-1'
        FRONTEND_REPO  = 'frontend-repo'
        BACKEND_REPO   = 'backend-repo'
        FRONTEND_ECR   = "060795940192.dkr.ecr.${AWS_REGION}.amazonaws.com/${FRONTEND_REPO}"
        BACKEND_ECR    = "060795940192.dkr.ecr.${AWS_REGION}.amazonaws.com/${BACKEND_REPO}"
        DEPLOY_SERVER  = "ec2-user@13.60.68.117"//ec2 app-server instance ip
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo "Fetching latest code..."
                checkout scm
            }
        }

        stage('Build Frontend Image') {
            steps {
                sh 'docker build -t frontend-app -f frontend/Dockerfile ./frontend'
            }
        }

        stage('Build Backend Image') {
            steps {
                sh 'docker build -t backend-app -f backend/Dockerfile ./backend'
            }
        }

        stage('Login to ECR') {
            steps {
                sh '''
                aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $FRONTEND_ECR
                aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $BACKEND_ECR
                '''
            }
        }

        stage('Push Docker Images') {
            steps {
                script {
                    sh '''
                    docker tag frontend-app:latest $FRONTEND_ECR:${BUILD_NUMBER}
                    docker push $FRONTEND_ECR:${BUILD_NUMBER}

                    docker tag backend-app:latest $BACKEND_ECR:${BUILD_NUMBER}
                    docker push $BACKEND_ECR:${BUILD_NUMBER}
                    '''
                }
            }
        }

        stage('Deploy on App Server') {
            steps {
                sshagent (credentials: ['ec2-ssh-key']) {// add crentential ec2-key.pem content in password
                    sh """
                    ssh -o StrictHostKeyChecking=no $DEPLOY_SERVER '
                        echo "Logging into ECR..."
                        aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $FRONTEND_ECR
                        aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $BACKEND_ECR

                        echo "Stopping old containers..."
                        docker stop frontend || true && docker rm frontend || true
                        docker stop backend || true && docker rm backend || true

                        echo "Pulling new images..."
                        docker pull $FRONTEND_ECR:${BUILD_NUMBER}
                        docker pull $BACKEND_ECR:${BUILD_NUMBER}

                        echo "Starting new containers..."
                        docker run -d -p 80:80 --name frontend $FRONTEND_ECR:${BUILD_NUMBER}
                        docker run -d -p 5000:5000 --name backend $BACKEND_ECR:${BUILD_NUMBER}
                    '
                    """
                }
            }
        }
    }

    post {
        success {
            echo "Deployment successful! Your app is live!"
        }
        failure {
            echo "Deployment failed. Check logs."
        }
    }
}
