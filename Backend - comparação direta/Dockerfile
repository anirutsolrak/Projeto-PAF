# Usar uma imagem base oficial do Python - Exemplo com 3.12
FROM python:3.13.3-slim

# Definir o diretório de trabalho dentro do container
WORKDIR /app

# Copiar o arquivo de dependências primeiro para aproveitar o cache do Docker
COPY requirements.txt .

# Instalar as dependências
RUN pip install --no-cache-dir -r requirements.txt

# Copiar o restante do código da aplicação (incluindo app.py e a pasta frontend_build)
COPY . .

# Expor a porta que o Flask vai usar dentro do container
EXPOSE 5001

# Comando para rodar a aplicação quando o container iniciar
CMD ["python", "app.py"]