# Implantação em nuvem — Vértice

## Estado

Há uma imagem Docker reproduzível; a implantação pública e os testes de campo ainda precisam ser registrados.

## Contrato de execução

- contêiner Linux com `PORT` exposta;
- volume persistente em `/app/data`;
- `DATABASE_PATH=/app/data/vertice.db`;
- `SEED_DATABASE=false` em produção;
- HTTPS obrigatório para service worker e geolocalização;
- monitoramento por `GET /health`.

## Homologação local

```bash
docker build -t vertice:0.1.0 .
docker volume create vertice-data
docker run --rm -p 3002:3002 -v vertice-data:/app/data vertice:0.1.0
curl http://localhost:3002/health
```

## Checklist de publicação

- validar instalação da PWA em pelo menos dois dispositivos;
- alternar entre online e offline e confirmar sincronização idempotente;
- reiniciar o serviço e verificar persistência;
- não coletar fotos, nomes ou coordenadas reais sem autorização;
- registrar URL, data, commit, release e resultados no relatório.
