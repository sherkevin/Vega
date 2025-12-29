# 测试 Docker 镜像是否可用
Write-Host "测试 Docker 镜像拉取..." -ForegroundColor Cyan

$images = @(
    "docker.1ms.run/pgvector/pgvector:pg16",
    "docker.1ms.run/chromadb/chroma",
    "docker.1ms.run/atendai/evolution-api:latest",
    "docker.1ms.run/mintplexlabs/anythingllm:latest"
)

foreach ($image in $images) {
    Write-Host "`n测试镜像: $image" -ForegroundColor Yellow
    docker pull $image
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $image - 拉取成功" -ForegroundColor Green
    } else {
        Write-Host "❌ $image - 拉取失败" -ForegroundColor Red
    }
}

Write-Host "`n测试完成！" -ForegroundColor Cyan

