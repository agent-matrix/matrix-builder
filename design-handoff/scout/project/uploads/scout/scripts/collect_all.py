#!/usr/bin/env python
from app.collectors.committers_collector import aggregate_committers_signal

def main():
    print(aggregate_committers_signal("Italy", "Rome"))

if __name__ == "__main__":
    main()
