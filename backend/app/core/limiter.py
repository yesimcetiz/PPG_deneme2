"""
Merkezi rate limiter — tüm router'lar buradan import eder.
Böylece tek bir limiter instance app.state ile senkronize kalır.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
