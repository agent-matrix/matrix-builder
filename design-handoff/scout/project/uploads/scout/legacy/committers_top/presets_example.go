package main

// This is a tiny reference stub. Scout uses app/data/locations.py as the active preset system.
type QueryPreset struct {
    Title string
    Include []string
    Exclude []string
}

var Presets = map[string]QueryPreset{
    "italy": {Title: "Italy", Include: []string{"italy", "italia", "rome", "roma", "milan", "turin"}},
    "worldwide": {Title: "Worldwide", Include: []string{}},
}
