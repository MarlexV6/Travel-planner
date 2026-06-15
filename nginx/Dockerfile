FROM node:18-alpine AS builder

WORKDIR /app

COPY client/package*.json ./

RUN npm ci --legacy-peer-deps

COPY client/ .

ARG REACT_APP_API_URL=/api
ARG REACT_APP_GOOGLE_MAPS_API_KEY
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_GOOGLE_MAPS_API_KEY=$REACT_APP_GOOGLE_MAPS_API_KEY

RUN npm run build

FROM nginx:alpine

RUN rm -f /etc/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/nginx.conf

COPY --from=builder /app/build /usr/share/nginx/html

COPY nginx/ssl/cert.pem /etc/nginx/ssl/cert.pem
COPY nginx/ssl/key.pem /etc/nginx/ssl/key.pem

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]