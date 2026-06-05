pipeline {
  agent any

  environment {
    SERVICES  = 'gateway auth traffic route prediction'
    IMAGE_TAG = "${env.GIT_COMMIT?.take(7) ?: 'latest'}"
    REGISTRY  = 'taxico'
  }

  options {
    buildDiscarder(logRotator(numToKeepStr: '10'))
    timeout(time: 30, unit: 'MINUTES')
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
        sh 'echo "Building commit: ${IMAGE_TAG}"'
      }
    }

    stage('Install dependencies') {
      steps {
        sh 'npm ci'
      }
    }

    stage('Type check') {
      steps {
        sh 'npm run typecheck --workspaces --if-present'
      }
    }

    stage('Build') {
      steps {
        sh 'npm run build'
      }
    }

    stage('Build Docker images') {
      steps {
        script {
          for (svc in env.SERVICES.split(' ')) {
            sh """
              docker build \
                --build-arg SERVICE=${svc} \
                -f Dockerfile.service \
                -t ${REGISTRY}-${svc}:${IMAGE_TAG} \
                -t ${REGISTRY}-${svc}:latest \
                .
            """
          }
          sh """
            docker build \
              -t ${REGISTRY}-web:${IMAGE_TAG} \
              -t ${REGISTRY}-web:latest \
              ./apps/web
          """
        }
      }
    }

    stage('Deploy to k3s') {
      when { branch 'main' }
      steps {
        script {
          for (svc in env.SERVICES.split(' ')) {
            sh """
              docker save ${REGISTRY}-${svc}:${IMAGE_TAG} | k3s ctr images import -
              kubectl set image deployment/${svc} ${svc}=${REGISTRY}-${svc}:${IMAGE_TAG} -n taxico
              kubectl rollout status deployment/${svc} -n taxico --timeout=120s
            """
          }
          sh """
            docker save ${REGISTRY}-web:${IMAGE_TAG} | k3s ctr images import -
            kubectl set image deployment/web web=${REGISTRY}-web:${IMAGE_TAG} -n taxico
            kubectl rollout status deployment/web -n taxico --timeout=120s
          """
        }
      }
    }
  }

  post {
    success {
      echo "Pipeline succeeded for commit ${IMAGE_TAG}"
    }
    failure {
      echo "Pipeline failed at stage ${env.STAGE_NAME}"
    }
  }
}
