# Railway project configuration

This file defines the staging API service and its persistent `/app/data` volume.

Before applying it, review `railway config plan`. Set `APP_PASSWORD` and `SESSION_SECRET` as sealed Railway variables; never commit them. The public domain is generated after a successful deployment.
