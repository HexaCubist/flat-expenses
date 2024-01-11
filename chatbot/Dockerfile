# Dockerfile
FROM node:20.10.0
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "yarn.lock", "./"]
RUN yarn
COPY . .
ARG FB_THREAD
ENV FB_THREAD=$FB_THREAD

ARG FB_OWNER
ENV FB_OWNER=$FB_OWNER

ARG FB_APPSTATE
ENV FB_APPSTATE=$FB_APPSTATE

CMD node index.js
