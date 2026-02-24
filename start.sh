#!/bin/sh
# Replace NGINX_PORT placeholder with actual PORT value
sed -i "s/NGINX_PORT/${PORT:-8080}/g" /etc/nginx/conf.d/default.conf
nginx -g 'daemon off;'
