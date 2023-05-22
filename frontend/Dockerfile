FROM node:19.8.1 as build
WORKDIR /frontend
COPY package*.json ./
COPY . .
RUN npm ci
RUN npm run build_docker

FROM nginx
COPY --from=build /frontend/build /usr/share/nginx/html/brno-PTSAT
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
