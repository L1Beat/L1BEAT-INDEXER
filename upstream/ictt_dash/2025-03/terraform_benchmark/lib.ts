import { $ } from "bun";

export async function getTerraformIps(): Promise<string[]> {
    const terraformJson = await $`terraform output -json`.json();
    return Object.values(terraformJson).map((ip: any) => ip.value);
}

export async function executeCommandEveryIp(command: string | ((ip: string) => string), parallel = false) {
    const ips = await getTerraformIps();

    async function executeOnIp(ip: string) {
        const commandToExecute = typeof command === 'function' ? command(ip) : command;
        const result = await $`ssh -i ./id_ed25519 -o StrictHostKeyChecking=no ubuntu@${ip} ${commandToExecute}`.text()
        console.log(`------\n [${ips.indexOf(ip) + 1}/${ips.length}] Executing command on ${ip}: ${commandToExecute}`);
        console.log(`>>>>>>\n\`${result}\`\n<<<<<<`);
    }

    if (parallel) {
        await Promise.all(ips.map(executeOnIp));
    } else {
        for (const ip of ips) {
            await executeOnIp(ip);
        }
    }
}
