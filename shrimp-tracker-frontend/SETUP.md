# Shrimp Tracker Frontend Setup Guide

## Overview
This project uses **Python** and **Streamlit** inside a **virtual environment (venv)** to isolate dependencies.
Follow the steps below according to your operating system.

---

## macOS / Linux Setup

### First-time setup
```bash
# Navigate to the project folder
cd shrimp-tracker-frontend

# Create a virtual environment
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt  # (or pip install streamlit if no requirements.txt yet)
```
### Running the app on every new session
```bash
cd shrimp-tracker-frontend
source venv/bin/activate
streamlit run app.py
``` 
## Windows Setup 

### First-time Setup
```bash 
# Navigate to the project folder
cd shrimp-tracker-frontend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt  # (or pip install streamlit if no requirements.txt yet)
```
### Running the app on every new session
```bash
cd shrimp-tracker-frontend
venv\Scripts\activate
streamlit run app.py
```

## Web App termination 

### In the IDE's terminal, press [CTRL] + C
### If done correctly, there will be a 
```
Stopping...
```

## Note:
#### sometimes run this is ensure all dependency versions are up to date
```bash
pip install -r requirements.txt
```