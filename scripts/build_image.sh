#!/bin/bash
set -e
if [ -f $WORKSPACE/../TOGGLE ]; then
    echo "****************************************************"
    echo "data.stack:dm :: Toggle mode is on, terminating build"
    echo "data.stack:dm :: BUILD CANCLED"
    echo "****************************************************"
    exit 0
fi

cDate=`date +%Y.%m.%d.%H.%M` #Current date and time

if [ -f $WORKSPACE/../CICD ]; then
    CICD=`cat $WORKSPACE/../CICD`
fi
if [ -f $WORKSPACE/../DATA_STACK_RELEASE ]; then
    REL=`cat $WORKSPACE/../DATA_STACK_RELEASE`
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
    echo "data.stack:dm :: Please Create file DATA_STACK_RELEASE with the releaese at $WORKSPACE or provide it as 1st argument of this script."
    echo "data.stack:dm :: BUILD FAILED"
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
    echo "data.stack:dm :: CICI env found"
    echo "****************************************************"
    TAG=$TAG"_"$cDate
    if [ ! -f $WORKSPACE/../DATA_STACK_NAMESPACE ]; then
        echo "****************************************************"
        echo "data.stack:dm :: Please Create file DATA_STACK_NAMESPACE with the namespace at $WORKSPACE"
        echo "data.stack:dm :: BUILD FAILED"
        echo "****************************************************"
        exit 0
    fi
    DATA_STACK_NS=`cat $WORKSPACE/../DATA_STACK_NAMESPACE`
fi

sh $WORKSPACE/scripts/prepare_yaml.sh $REL $2

echo "****************************************************"
echo "data.stack:dm :: Using build :: "$TAG
echo "****************************************************"

cd $WORKSPACE

echo "****************************************************"
echo "data.stack:dm :: Adding IMAGE_TAG in Dockerfile :: "$TAG
echo "****************************************************"
sed -i.bak s#__image_tag__#$TAG# Dockerfile

if [ -f $WORKSPACE/../CLEAN_BUILD_DM ]; then
    echo "****************************************************"
    echo "data.stack:dm :: Doing a clean build"
    echo "****************************************************"
    
    docker build --no-cache -t data.stack:dm.$TAG .
    rm $WORKSPACE/../CLEAN_BUILD_DM

    echo "****************************************************"
    echo "data.stack:dm :: Copying deployment files"
    echo "****************************************************"

    if [ $CICD ]; then
        sed -i.bak s#__docker_registry_server__#$DOCKER_REG# dm.yaml
        sed -i.bak s/__release_tag__/"'$REL'"/ dm.yaml
        sed -i.bak s#__release__#$TAG# dm.yaml
        sed -i.bak s#__namespace__#$DATA_STACK_NS# dm.yaml
        sed -i.bak '/imagePullSecrets/d' dm.yaml
        sed -i.bak '/- name: regsecret/d' dm.yaml
        sed -i.bak '/mountPath: \/app\/__docker_registry_type__/d' dm.yaml
        sed -i.bak '/- name: __docker_registry_type__/d' dm.yaml
        sed -i.bak '/- name: __docker_registry_type__/d' dm.yaml
        sed -i.bak '/secret:/d' dm.yaml
        sed -i.bak '/secretName: odp-gcr-json-key/d' dm.yaml

        kubectl delete deploy dm -n $DATA_STACK_NS || true # deleting old deployement
        kubectl delete service dm -n $DATA_STACK_NS || true # deleting old service
        #creating dmw deployment
        kubectl create -f dm.yaml
    fi

else
    echo "****************************************************"
    echo "data.stack:dm :: Doing a normal build"
    echo "****************************************************"
    docker build -t data.stack:dm.$TAG .
    if [ $CICD ]; then
        if [ $DOCKER_REG ]; then
            kubectl set image deployment/dm dm=$DOCKER_REG/data.stack:dm.$TAG -n $DATA_STACK_NS --record=true
        else 
            kubectl set image deployment/dm dm=data.stack:dm.$TAG -n $DATA_STACK_NS --record=true
        fi
    fi
fi
if [ $DOCKER_REG ]; then
    echo "****************************************************"
    echo "data.stack:dm :: Docker Registry found, pushing image"
    echo "****************************************************"

    docker tag data.stack:dm.$TAG $DOCKER_REG/data.stack:dm.$TAG
    docker push $DOCKER_REG/data.stack:dm.$TAG
fi
echo "****************************************************"
echo "data.stack:dm :: BUILD SUCCESS :: data.stack:dm.$TAG"
echo "****************************************************"
echo $TAG > $WORKSPACE/../LATEST_DM
