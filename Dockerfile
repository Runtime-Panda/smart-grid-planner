# Stage 1: Build the React app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve with nginx on port 8080
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
RUN sed -i 's/listen  *80;/listen 8080;/' /etc/nginx/conf.d/default.conf
EXPOSE 8080
