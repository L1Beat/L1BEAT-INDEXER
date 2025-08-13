publish:
	docker buildx create --use --name multiarch-builder --platform linux/amd64,linux/arm64 || true
	docker buildx build --push --platform linux/amd64,linux/arm64 -t containerman17/evmbombard:latest .
