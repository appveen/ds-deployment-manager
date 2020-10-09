#!/bin/bash

echo "****************************************************"
echo "odp:dm :: Copying yaml file "
echo "****************************************************"
if [ ! -d $WORKSPACE/../yamlFiles ]; then
    mkdir $WORKSPACE/../yamlFiles
fi

REL=$1
if [ $2 ]; then
    REL=$REL-$2
fi

rm -rf $WORKSPACE/../yamlFiles/dm.*
cp $WORKSPACE/dm.yaml $WORKSPACE/../yamlFiles/dm.$REL.yaml

if [ -f $WORKSPACE/dm.podman.yaml ]; then
    cp $WORKSPACE/dm.podman.yaml $WORKSPACE/../yamlFiles/dm.podman.$REL.yaml
fi

cd $WORKSPACE/../yamlFiles/
echo "****************************************************"
echo "odp:dm :: Preparing yaml file "
echo "****************************************************"
sed -i.bak s/__release_tag__/"'$1'"/ dm.$REL.yaml
sed -i.bak s/__release__/$REL/ dm.$REL.yaml

if [ -f $WORKSPACE/dm.podman.yaml ]; then
    sed -i.bak s/__release__/$REL/ dm.podman.$REL.yaml
fi
