###############################################################################################
# DOCKER
###############################################################################################

FROM docker:19 as docker 

###############################################################################################
# PODMAN-BUILDER
###############################################################################################

FROM appveen/podman:1.6.4 AS podman-builder

###############################################################################################
# Take what is only required
###############################################################################################

FROM node:16-alpine

RUN set -ex;
RUN set -ex; apk add --no-cache --virtual .fetch-deps
RUN set -ex; apk add ca-certificates 
RUN set -ex; apk add curl 
RUN set -ex; apk add tar 
RUN set -ex; apk add git 
RUN set -ex; apk add openssl 
RUN set -ex; apk add python3
RUN set -ex; apk add py-pip 
RUN set -ex; apk add less 
RUN set -ex; apk add device-mapper gpgme ip6tables libseccomp libselinux ostree
RUN set -ex; pip3 install --upgrade awscli==1.14.5 python-magic
RUN	set -ex; apk -v --purge del py-pip

COPY --from=docker /bin /bin
COPY --from=docker /usr /usr
COPY --from=docker /var /var
COPY --from=docker /etc /etc

COPY --from=podman-builder /usr/bin/conmon /usr/bin/
COPY --from=podman-builder /usr/bin/runc /usr/bin/
COPY --from=podman-builder /usr/bin/podman /usr/bin/

COPY --from=podman-builder /etc/cni/net.d /etc/cni/net.d
COPY --from=podman-builder /etc/containers /etc/containers

WORKDIR /app

COPY package.json /app

RUN npm install --production

COPY api /app/api
COPY app.js /app
COPY config /app/config

ENV IMAGE_TAG=__image_tag__

EXPOSE 10709

RUN mkdir /app/generatedDeployments

RUN chmod -R 777 /app/generatedDeployments

CMD node app.js
