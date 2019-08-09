# Temperature Agent

This is a nodejs command-line application that gathers temperature data (in conjunction with bash and python scripts in scripts repo) and publishes it to a REST API.  It also:

- Sends email-based alerts
- Reports basic system info (IP, OS, agent version)
- Provides remote configuration of alert parameters
- Provides historical graphing and limited configuration via local web pages

It has been successfully tested on Debian and Raspbian OSes.
