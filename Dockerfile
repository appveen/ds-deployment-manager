###############################################################################################
# DOCKER
###############################################################################################

# FROM docker:18 as docker 

###############################################################################################
# PODMAN-BUILDER
###############################################################################################

FROM appveen/podman:1.6.4 AS podman-builder

###############################################################################################
# Take what is only required
###############################################################################################

FROM node:12-alpine

# RUN set -ex; \
#     apk add --no-cache --virtual .fetch-deps \
#       ca-certificates \
#       curl \
#       tar \
#       git \
#       openssl \
#       python \
#       py-pip \
#       less \
#       device-mapper gpgme ip6tables libseccomp libselinux ostree && \
#     pip install --upgrade awscli==1.14.5 python-magic && \
#     apk -v --purge del py-pip

# COPY --from=docker /bin /bin
# COPY --from=docker /usr /usr
# COPY --from=docker /var /var
# COPY --from=docker /etc /etc
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
