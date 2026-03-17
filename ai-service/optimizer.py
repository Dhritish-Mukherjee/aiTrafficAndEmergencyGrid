def calculate_optimal_timing(vehicle_count: int, cross_street_count: int = None) -> dict:
    """
    Computes optimal traffic signal green/red bounds using Webster's Formula:
    C_opt = (1.5L + 5) / (1 - Y)
    
    where:
      C = Optimum cycle length
      L = Total lost time per cycle (assumed 12s for 2 clear phases)
      Y = sum(y_i) for each phase, where y_i = Volume(q) / Saturation Flow(S)
    
    All values are clipped to avoid dangerous extremes (green forced between 15s - 90s).
    """
    L = 12
    S = 1800  # Saturation flow limit equivalent (cars/hr) per lane

    # 1. Expand the arbitrary 10-second vehicle camera glimpse into a theoretical 1 hour volume (q)
    # E.g. 5 cars in 10 sec = 1800 cars/hr
    q_main = vehicle_count * (3600 / 10)
    
    # Normally a second camera feeds this. If missing, we assume a static low load.
    if cross_street_count is None:
        q_cross = 400
    else:
        q_cross = cross_street_count * (3600 / 10)
        
    y_main = q_main / S
    y_cross = q_cross / S
    Y = y_main + y_cross

    # Limit Y heavily. If Y >= 1, the intersection is totally over-saturated.
    # We clip it to 0.9 safely so (1 - Y) is never 0 or negative.
    Y = min(max(Y, 0.1), 0.9)

    # 2. Optimal cycle time calculation
    C = (1.5 * L + 5) / (1 - Y)

    # Hard-clip total cycle. Shouldn't drop below 40s or exceed 150s for driver sanity.
    C = max(40, min(150, C))

    # 3. Distributed Green Time
    # Effective green = total cycle - lost time
    G = C - L

    # Share green time proportionately based on the main Y fraction vs cross Y fraction
    total_y = max(Y, 0.01)  # avoid /0
    green_main = (y_main / total_y) * G
    
    g_main = int(round(green_main))
    g_cross = int(round(G - green_main))

    # 4. Mandatory Safety Clamping 
    # Must explicitly limit between 15s to 90s maximum
    g_main = max(15, min(90, g_main))
    g_cross = max(15, min(90, g_cross))
    
    # Red for main = Green + Lost Time for cross
    r_main = g_cross + L

    return {
        "greenDuration": g_main,
        "redDuration": r_main,
        "cycleLength": g_main + r_main
    }
