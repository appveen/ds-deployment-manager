#!/bin/bash
set -e
if [ -f $WORKSPACE/../TOGGLE ]; then
    echo "****************************************************"
    echo "odp:dm :: Toggle mode is on, terminating build"
    echo "odp:dm :: BUILD CANCLED"
    echo "****************************************************"
    exit 0
fi

cDate=`date +%Y.%m.%d.%H.%M` #Current date and time

if [ -f $WORKSPACE/../CICD ]; then
    CICD=`cat $WORKSPACE/../CICD`
fi
if [ -f $WORKSPACE/../ODP_RELEASE ]; then
    REL=`cat $WORKSPACE/../ODP_RELEASE`
fi
if [ -f $WORKSPACE/../DOCKER_REGISTRY ]; then
    DOCKER_REG=`cat $WORKSPACE/../DOCKER_REGISTRY`
fi
BRANCH='dev'
if [ -f $WORKSPACE/../BRANCH ]; then
    BRANCH=`cat $WORKSPACE/../BRANCH`
fi
if [ $1 ]; then
    REL=$1
fi
if [ ! $REL ]; then
    echo "****************************************************"
    echo "odp:dm :: Please Create file ODP_RELEASE with the releaese at $WORKSPACE or provide it as 1st argument of this script."
    echo "odp:dm :: BUILD FAILED"
    echo "****************************************************"
    exit 0
fi
TAG=$REL
if [ $2 ]; then
    TAG=$TAG"-"$2
fi
if [ $3 ]; then
    BRANCH=$3
fi
if [ $CICD ]; then
    echo "****************************************************"
    echo "odp:dm :: CICI env found"
    echo "****************************************************"
    TAG=$TAG"_"$cDate
    if [ ! -f $WORKSPACE/../ODP_NAMESPACE ]; then
        echo "****************************************************"
        echo "odp:dm :: Please Create file ODP_NAMESPACE with the namespace at $WORKSPACE"
        echo "odp:dm :: BUILD FAILED"
        echo "****************************************************"
        exit 0
    fi
    ODP_NS=`cat $WORKSPACE/../ODP_NAMESPACE`
fi

sh $WORKSPACE/scripts/prepare_yaml.sh $REL $2

echo "****************************************************"
echo "odp:dm :: Using build :: "$TAG
echo "****************************************************"

cd $WORKSPACE

echo "****************************************************"
echo "odp:dm :: Adding IMAGE_TAG in Dockerfile :: "$TAG
echo "****************************************************"
sed -i.bak s#__image_tag__#$TAG# Dockerfile

if [ -f $WORKSPACE/../CLEAN_BUILD_DM ]; then
    echo "****************************************************"
    echo "odp:dm :: Doing a clean build"
    echo "****************************************************"
    
    docker build --no-cache -t odp:dm.$TAG .
    rm $WORKSPACE/../CLEAN_BUILD_DM

    echo "****************************************************"
    echo "odp:dm :: Copying deployment files"
    echo "****************************************************"

    if [ $CICD ]; then
        sed -i.bak s#__docker_registry_server__#$DOCKER_REG# dm.yaml
        sed -i.bak s/__release_tag__/"'$REL'"/ dm.yaml
        sed -i.bak s#__release__#$TAG# dm.yaml
        sed -i.bak s#__namespace__#$ODP_NS# dm.yaml
        sed -i.bak '/imagePullSecrets/d' dm.yaml
        sed -i.bak '/- name: regsecret/d' dm.yaml
        sed -i.bak '/mountPath: \/app\/__docker_registry_type__/d' dm.yaml
        sed -i.bak '/- name: __docker_registry_type__/d' dm.yaml
        sed -i.bak '/- name: __docker_registry_type__/d' dm.yaml
        sed -i.bak '/secret:/d' dm.yaml
        sed -i.bak '/secretName: odp-gcr-json-key/d' dm.yaml

        kubectl delete deploy dm -n $ODP_NS || true # deleting old deployement
        kubectl delete service dm -n $ODP_NS || true # deleting old service
        #creating dmw deployment
        kubectl create -f dm.yaml
    fi

else
    echo "****************************************************"
    echo "odp:dm :: Doing a normal build"
    echo "****************************************************"
    docker build -t odp:dm.$TAG .
    if [ $CICD ]; then
        kubectl set image deployment/dm dm=odp:dm.$TAG -n $ODP_NS --record=true
    fi
fi
if [ $DOCKER_REG ]; then
    echo "****************************************************"
    echo "odp:dm :: Docker Registry found, pushing image"
    echo "****************************************************"

    docker tag odp:dm.$TAG $DOCKER_REG/odp:dm.$TAG
    docker push $DOCKER_REG/odp:dm.$TAG
fi
echo "****************************************************"
echo "odp:dm :: BUILD SUCCESS :: odp:dm.$TAG"
echo "****************************************************"
echo $TAG > $WORKSPACE/../LATEST_DM
