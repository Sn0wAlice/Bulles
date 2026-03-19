# -- Build stage: compile Tailwind CSS --
FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:css

# -- Production stage --
FROM node:22-alpine

WORKDIR /app

# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy app code
COPY app.js ./
COPY lib/ ./lib/
COPY views/ ./views/
COPY data/migrations/ ./data/migrations/

# Copy pre-built static assets
COPY public/ ./public/
COPY --from=build /app/public/css/style.css ./public/css/style.css

# Create directories for volumes
RUN mkdir -p /app/data /app/uploads /app/public/uploads/covers

# Default db.json if volume is empty (handled by entrypoint)
COPY data/db.json /app/data/db.json.default

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "app.js"]
