FROM node:19.8.1

WORKDIR /usr/src/backend

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3033
CMD [ "npm", "run", "docker_run" ]