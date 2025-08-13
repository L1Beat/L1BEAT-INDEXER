#!/usr/bin/env -S bun
import { Table } from "console-table-printer";

export { }; // Make this file a module to allow top-level await

const MIN_NVME_SIZE = 3000;
const MIN_DISK_COUNT = 6;
const SKIP_HDD = true;

const OKAY_CPUS: string[] = [
    "AMD EPYC 7502",        // EPYC 7002 series, released 2019
    "AMD EPYC 7502P",       // EPYC 7002 series, released 2019
    "AMD Ryzen 5 3600",     // Ryzen 3000 series, released July 7, 2019
    "AMD Ryzen 7 3700X",    // Ryzen 3000 series, released July 7, 2019
    "AMD Ryzen 9 3900",     // Ryzen 3000 series, released 2019
    "AMD Ryzen 9 5950X",    // Ryzen 5000 series, released November 5, 2020
    "Intel Core i5-12500",  // Alder Lake, 12th gen, released November 4, 2021
    "Intel Core i9-12900K", // Alder Lake, 12th gen, released November 4, 2021
    "Intel XEON E-2276G",   // Coffee Lake refresh, released 2019
    "Intel Xeon W-2245",    // Cascade Lake-W, released 2019
    "Intel Xeon W-2295"     // Cascade Lake-W, released 2019
];

const OLD_SHIT_CPUS: string[] = [
    "AMD EPYC 7401P",               // EPYC 7000 series, released 2017
    "AMD Ryzen 7 1700X",           // Ryzen 1000 series, released March 2, 2017
    "AMD Ryzen 7 PRO 1700X",       // Ryzen 1000 PRO series, released June 29, 2017
    "AMD Ryzen Threadripper 2950X", // Threadripper 2000 series, released August 31, 2018
    "Intel Core i7-6700",          // Skylake, 6th gen, released August 5, 2015
    "Intel Core i7-7700",          // Kaby Lake, 7th gen, released January 2017
    "Intel Core i7-8700",          // Coffee Lake, 8th gen, released October 2017
    "Intel Core i9-9900K",         // Coffee Lake Refresh, 9th gen, released October 2018
    "Intel XEON E-2176G",          // Coffee Lake based, released 2018
    "Intel Xeon E3-1270V3",        // Haswell, released June 2013
    "Intel Xeon E3-1271V3",        // Haswell, released June 2013
    "Intel Xeon E3-1275V6",        // Kaby Lake, released January 2017
    "Intel Xeon E3-1275v5",        // Skylake, released 2015
    "Intel Xeon E5-1650V3",        // Haswell, released September 2014
    "Intel Xeon W-2145"            // Skylake-W, released 2017
];

interface ServerDiskData {
    nvme: number[];
    sata: number[];
    hdd: number[];
    general: number[];
}

interface IpPrice {
    Monthly: number;
    Hourly: number;
    Amount: number;
}

interface Server {
    id: number;
    key: number;
    name: string;
    description: string[];
    information: string[];
    category: string;
    cat_id: number;
    cpu: string;
    cpu_count: number;
    is_highio: boolean;
    traffic: string;
    bandwidth: number;
    ram: string[];
    ram_size: number;
    price: number;
    setup_price: number;
    hourly_price: number;
    hdd_arr: string[];
    hdd_hr: string[];
    hdd_size: number;
    hdd_count: number;
    serverDiskData: ServerDiskData;
    is_ecc: boolean;
    datacenter: string;
    datacenter_hr: string;
    specials: string[];
    dist: string[];
    fixed_price: boolean;
    next_reduce: number;
    next_reduce_hr: boolean;
    next_reduce_timestamp: number;
    ip_price: IpPrice;
}

interface HetznerData {
    server: Server[];
}

const response = await fetch("https://www.hetzner.com/_resources/app/data/app/live_data_sb_USD.json");
const data: HetznerData = await response.json();

// Sort servers by price ascending
data.server.sort((a, b) => a.price - b.price);

// Create table
const table = new Table({
    title: "Hetzner Servers (Sorted by Price)",
    columns: [
        { name: 'datacenter', title: 'Datacenter', alignment: 'left' },
        { name: 'cpu', title: 'CPU', alignment: 'left' },
        { name: 'ram', title: 'RAM (GB)', alignment: 'right' },
        { name: 'totalDisk', title: 'Total Disk (GB)', alignment: 'right' },
        { name: 'price', title: 'Price ($)', alignment: 'right' },
        { name: 'allDisks', title: 'All Disks', alignment: 'left' }
    ]
});

data.server.forEach(server => {
    // Apply MIN_NVME_SIZE and MIN_DISK_COUNT filter
    // Check if any disk category has at least MIN_DISK_COUNT disks that are each >= MIN_NVME_SIZE
    const meetsRequirements = Object.values(server.serverDiskData).some(diskArray => {
        const qualifyingDisks = diskArray.filter(size => size >= MIN_NVME_SIZE);
        return qualifyingDisks.length >= MIN_DISK_COUNT;
    });

    if (!meetsRequirements) {
        return;
    }

    const totalDiskSize = server.serverDiskData.nvme.reduce((sum, size) => sum + size, 0)
        + server.serverDiskData.sata.reduce((sum, size) => sum + size, 0);

    // Helper function to format disk arrays
    const formatDisks = (disks: number[], type: string) => {
        if (disks.length === 0) return '';

        const counts = new Map<number, number>();
        disks.forEach(size => {
            counts.set(size, (counts.get(size) || 0) + 1);
        });

        const formatted = Array.from(counts.entries())
            .map(([size, count]) => count === 1 ? `${size}` : `${size} x${count}`)
            .join(',');

        return `${type} ${formatted}`;
    };

    const nvmeDisks = formatDisks(server.serverDiskData.nvme, 'nvme');
    const sataDisks = formatDisks(server.serverDiskData.sata, 'sata');
    const hddDisks = formatDisks(server.serverDiskData.hdd, 'hdd');

    if (server.serverDiskData.hdd.length > 0 && SKIP_HDD) {
        return
    }

    const allDisks = [nvmeDisks, sataDisks, hddDisks].filter(Boolean).join(" + ");
    const cpuEmoji = OKAY_CPUS.includes(server.cpu) ? "⭐" : OLD_SHIT_CPUS.includes(server.cpu) ? "💩" : "🤷";
    const displayCpu = `${cpuEmoji} ${server.cpu}`;

    table.addRow({
        datacenter: server.datacenter,
        cpu: displayCpu,
        ram: server.ram_size,
        totalDisk: totalDiskSize,
        price: server.price,
        allDisks: allDisks
    });
});


table.printTable();
