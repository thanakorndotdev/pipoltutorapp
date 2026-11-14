FROM postgres:16-alpine
RUN apk add --no-cache age tar
COPY docker/backup.sh /usr/local/bin/pipol-backup
ENTRYPOINT ["sh", "/usr/local/bin/pipol-backup"]
