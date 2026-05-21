FROM node:18-alpine

WORKDIR /app

# Устанавливаем openssl для Prisma
RUN apk add --no-cache openssl

# Копируем package files
COPY package*.json ./
COPY prisma ./prisma/

# Устанавливаем зависимости
RUN npm install

# Генерируем Prisma клиент
RUN npx prisma generate

# Копируем остальной код
COPY . .

EXPOSE 5000

CMD ["node", "server.js"]