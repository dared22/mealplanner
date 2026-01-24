FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN npm install -g serve@14.2.3

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
