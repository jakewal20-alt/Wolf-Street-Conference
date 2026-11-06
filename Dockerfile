FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Railway passes service variables to declared build args. Unset: no suite bar.
ARG VITE_WOLFSTREET_BAR_URL
ENV VITE_WOLFSTREET_BAR_URL=$VITE_WOLFSTREET_BAR_URL
RUN npm run build
RUN npm install -g serve
CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT:-8080}"]
