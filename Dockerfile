# Etapa 1: Instalación de dependencias completas y generación del cliente Prisma
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

# Etapa 2: Descarga exclusiva de dependencias de producción
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Etapa 3: Entorno de ejecución en producción
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copiamos las dependencias de producción y el cliente de Prisma ya compilado
COPY package*.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copiamos el código fuente de la aplicación
COPY src ./src
COPY prisma ./prisma

EXPOSE 5000

CMD ["node", "src/index.js"]
