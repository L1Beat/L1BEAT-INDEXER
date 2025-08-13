export CHAIN_ID="J3MYb3rDARLmB7FrRybinyjKqVTqmerbCr9bAXDatrSaHiLxQ";
clear;
for i in {00..09}; do
    docker logs "meganode$i" | grep $CHAIN_ID
done
