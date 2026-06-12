def should_expire(age_seconds: int, ttl_seconds: int) -> bool:
    return age_seconds > ttl_seconds
