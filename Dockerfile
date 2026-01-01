# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
ARG LASTFM_API_KEY
ARG LASTFM_USERNAME
ARG LASTFM_CACHE_MINUTES=15
ARG LASTFM_HISTORY_PAGES=1
ARG SITE_TITLE="Musiclisten · Last.fm"
ENV NODE_ENV=production \
    LASTFM_API_KEY=${LASTFM_API_KEY} \
    LASTFM_USERNAME=${LASTFM_USERNAME} \
    LASTFM_CACHE_MINUTES=${LASTFM_CACHE_MINUTES} \
    LASTFM_HISTORY_PAGES=${LASTFM_HISTORY_PAGES} \
    SITE_TITLE=${SITE_TITLE}
RUN npm run build

FROM nginx:1.27-alpine AS final
WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist ./
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
